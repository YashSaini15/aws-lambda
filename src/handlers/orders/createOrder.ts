import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { logger } from "../../lib/logger";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../../lib/dynamo";
import { sqsClient } from "../../lib/sqs";
import { SendMessageCommand } from "@aws-sdk/client-sqs";

export const createOrderHandler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> => {
  logger.info("incoming request", {
    method: event.requestContext.http.method,
    path: event.rawPath,
  });

  if (event.headers["content-type"] !== "application/json") {
    return {
      statusCode: 415,
      body: JSON.stringify({ message: "Unsupported Media Type" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    if (!body.orderId) {
      return {
        statusCode: 422,
        body: JSON.stringify({ message: "orderId is required" }),
      };
    }

    await db.send(
      new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: {
          ...body,
        },
      }),
    );

    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: process.env.QUEUE_URL,
        MessageBody: JSON.stringify(body),
      }),
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Processing order: " + body.orderId }),
    };
  } catch (error) {
    logger.error("failed to create order", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
