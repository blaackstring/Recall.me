import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../config.js";

const s3Client = new S3Client({
    region: config.awsRegion,
    credentials: {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
    },
});

export const uploadToS3 = async (fileBuffer: Buffer, fileName: string, contentType: string): Promise<string> => {
    const bucketName = process.env.AWS_S3_BUCKET_NAME;

    if (!bucketName) {
        throw new Error("AWS_S3_BUCKET_NAME is not defined");
    }

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: `screenshots/${fileName}`,
        Body: fileBuffer,
        ContentType: contentType,
    });

    await s3Client.send(command);

    const cloudfrontUrl = config.cloudfrontUrl;
    if (cloudfrontUrl) {
        // Ensure no trailing slash on cloudfrontUrl and then append the path
        const base = cloudfrontUrl.endsWith('/') ? cloudfrontUrl.slice(0, -1) : cloudfrontUrl;
        return `${base}/screenshots/${fileName}`;
    }

    return `https://${bucketName}.s3.${config.awsRegion}.amazonaws.com/screenshots/${fileName}`;
};
