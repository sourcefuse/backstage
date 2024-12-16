import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

export class JenkinsReportsService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(region: string, bucketName: string) {
    this.s3Client = new S3Client({ region });
    this.bucketName = bucketName;
  }
}
