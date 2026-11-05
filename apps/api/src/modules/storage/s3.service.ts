import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>("s3.bucket")!;
    this.publicUrl = this.config.get<string>("s3.publicUrl")!.replace(/\/$/, "");

    this.client = new S3Client({
      endpoint: this.config.get<string>("s3.endpoint"),
      region: this.config.get<string>("s3.region"),
      forcePathStyle: this.config.get<boolean>("s3.forcePathStyle"),
      credentials: {
        accessKeyId: this.config.get<string>("s3.accessKey")!,
        secretAccessKey: this.config.get<string>("s3.secretKey")!,
      },
    });
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return this.getPublicUrl(key);
  }

  async download(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as AsyncIterable<Buffer>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  keyFromUrl(url: string): string {
    return url.replace(`${this.publicUrl}/`, "");
  }
}
