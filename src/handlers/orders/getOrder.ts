import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { logger } from "../../lib/logger";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../../lib/dynamo";

export const getOrderHandler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> => {
  logger.info("incoming request", {
    method: event.requestContext.http.method,
    path: event.rawPath,
  });
  const orderId = event.rawPath.split("/")[2];
  if (!orderId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "orderId is required" }),
    };
  }

  try {
    const order = await db.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME!,
        Key: { orderId },
      }),
    );

    if (order.Item === undefined) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Order not found" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Order details for orderId: " + orderId,
        order: order.Item,
      }),
    };
  } catch (error) {
    logger.error("failed to get order", {
      orderId,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
