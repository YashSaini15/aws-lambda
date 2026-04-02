import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { logger } from "../../lib/logger";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../../lib/dynamo";

export const updateOrderHandler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> => {
  logger.info("incoming request", {
    method: event.requestContext.http.method,
    path: event.rawPath,
  });
  const orderId = event.rawPath.split("/")[2];
  if (event.headers["content-type"] !== "application/json") {
    return {
      statusCode: 415,
      body: JSON.stringify({ message: "Unsupported Media Type" }),
    };
  }
  try {
    const body = JSON.parse(event.body || "{}");

    if (body === undefined || Object.keys(body).length === 0) {
      return {
        statusCode: 422,
        body: JSON.stringify({ message: "Request body cannot be empty" }),
      };
    }

    if (!orderId) {
      return {
        statusCode: 422,
        body: JSON.stringify({ message: "orderId is required" }),
      };
    }

    await db.send(
      new UpdateCommand({
        TableName: process.env.TABLE_NAME!,
        Key: { orderId: orderId },
        UpdateExpression:
          "SET " +
          Object.keys(body)
            .filter((key) => key !== "orderId")
            .map((key) => `#${key} = :${key}`)
            .join(", "),
        ExpressionAttributeNames: Object.keys(body).reduce(
          (acc, key) => ({ ...acc, [`#${key}`]: key }),
          {},
        ),
        ExpressionAttributeValues: Object.keys(body).reduce(
          (acc, key) => ({ ...acc, [`:${key}`]: body[key] }),
          {},
        ),
      }),
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Processing order: " + orderId }),
    };
  } catch (error) {
    logger.error("failed to update order", {
      orderId,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
