import { JenkinsApiImpl } from './jenkinsApi';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class JenkinsReportsApi {
  // @ts-ignore
  private readonly jenkinsService: JenkinsApiImpl;

  constructor(jenkinsService: JenkinsApiImpl) {
    this.jenkinsService = jenkinsService;
  }

  async fetchBuildReports(
    name: string,
    jobFullName: string,
    buildNumber: number,
    s3bucketName: string,
    s3BucketRoleArn: string,
    s3BucketRegion: string,
  ) {
    const prefix = `${name}/${decodeURI(jobFullName)}/${buildNumber}/`;

    // Step 1: Assume the specified IAM role using default credentials
    const stsClient = new STSClient({ region: s3BucketRegion });
    console.log("Assume role sts inputs--------",s3BucketRoleArn, s3BucketRegion); //NOSONAR
    const assumeRoleCommand = new AssumeRoleCommand({
      // The Amazon Resource Name (ARN) of the role to assume.
      // RoleArn: "arn:aws:iam::804295906245:role/sf-test-assumrole-s3",
      RoleArn: s3BucketRoleArn,
      // An identifier for the assumed role session.
      RoleSessionName: 'session1',
      // The duration, in seconds, of the role session. The value specified
      // can range from 900 seconds (15 minutes) up to the maximum session
      // duration set for the role.
      DurationSeconds: 900,
    });
    try {
      const assumedRole = await stsClient.send(assumeRoleCommand);

      const { Credentials } = assumedRole;
      console.log("Assume role sts Credentials--------",Credentials); //NOSONAR
      // Step 2: Configure S3 client with temporary credentials from AssumeRole
      const s3Client = new S3Client({
        region: s3BucketRegion,
        credentials: {
          accessKeyId: Credentials!.AccessKeyId!,
          secretAccessKey: Credentials!.SecretAccessKey!,
          sessionToken: Credentials!.SessionToken!,
        },
      });

      const allObjects: string[] = [];
      let continuationToken: string | undefined;

      // Step 3: Fetch all objects using pagination
      do {
        const listCommand = new ListObjectsV2Command({
          Bucket: s3bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        });

        const listResponse = await s3Client.send(listCommand);
        continuationToken = listResponse.NextContinuationToken;

        if (listResponse.Contents) {
          allObjects.push(...listResponse.Contents.map(obj => obj.Key!));
        }
      } while (continuationToken);

      // Step 4: Filter and process files to fetch specific index.html files
      const indexFiles = allObjects.filter(
        key =>
          (key.includes('/Overall/coverage/') &&
            key.endsWith('/Overall/coverage/index.html')) ||
          (key.includes('/load-tests-reports/') &&
            key.endsWith('/index.html')) || // Matches load-tests-reports
          (key.includes('/report-') && key.endsWith('/index.html')), // Matches report folders with index.html
      );

      const files = await Promise.all(
        indexFiles.map(async key => {
          const getCommand = new GetObjectCommand({
            Bucket: s3bucketName,
            Key: key,
          });
          // @ts-ignore
          const url = await getSignedUrl(s3Client, getCommand, {
            expiresIn: 3600,
          });

          // Extract meaningful parts of the path to categorize reports
          const fileName = key.replace(prefix, '');
          return { fileName, url };
        }),
      );
      console.log("S3 Files--------",files); //NOSONAR
      return files;
    } catch (error) {
      console.log("s3 report error---------",error); //NOSONAR
      return { error: 'error' };
    }
  }
}
