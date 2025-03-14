import { S3Client } from '@aws-sdk/client-s3';

export class JenkinsReportsService {
  // @ts-ignore
  private readonly s3Client: S3Client;
  // @ts-ignore
  private readonly bucketName: string;

  constructor(region: string, bucketName: string) {
    this.s3Client = new S3Client({ region });
    this.bucketName = bucketName;
  }
}
