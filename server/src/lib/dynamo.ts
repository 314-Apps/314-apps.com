import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { SnapshotPayload } from "./types.js";

const PK = "SNAPSHOT";
const SK = "LATEST";

export function createDdbClient(): DynamoDBDocumentClient {
  const endpoint = process.env.DYNAMODB_ENDPOINT?.trim();
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    ...(endpoint ? { endpoint } : {}),
  });
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

export async function ensureTableExists(tableName: string): Promise<void> {
  const endpoint = process.env.DYNAMODB_ENDPOINT?.trim();
  const raw = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    ...(endpoint ? { endpoint } : {}),
  });

  try {
    await raw.send(new DescribeTableCommand({ TableName: tableName }));
    return;
  } catch {
    // create
  }

  await raw.send(
    new CreateTableCommand({
      TableName: tableName,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
    }),
  );
}

export async function getSnapshot(
  doc: DynamoDBDocumentClient,
  tableName: string,
): Promise<SnapshotPayload | null> {
  const out = await doc.send(
    new GetCommand({
      TableName: tableName,
      Key: { pk: PK, sk: SK },
    }),
  );
  const item = out.Item as Record<string, unknown> | undefined;
  if (!item?.payload) return null;
  return item.payload as SnapshotPayload;
}

export async function putSnapshot(
  doc: DynamoDBDocumentClient,
  tableName: string,
  payload: SnapshotPayload,
): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        pk: PK,
        sk: SK,
        payload,
        updatedAt: payload.fetchedAt,
      },
    }),
  );
}
