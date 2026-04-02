import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { logger } from "../../lib/logger";
import { db } from "../../lib/dynamo";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";

export const deleteOrderHandler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> => {
  logger.info("incoming request", {
    method: event.requestContext.http.method,
    path: event.rawPath,
  });
  const orderId = event.rawPath.split("/")[2];
  if (!orderId) {
    return {
      statusCode: 422,
      body: JSON.stringify({ message: "orderId is required" }),
    };
  }
  try {
    await db.send(
      new DeleteCommand({
        TableName: process.env.TABLE_NAME!,
        Key: { orderId: orderId },
      }),
    );
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Order deleted successfully" }),
    };
  } catch (error) {
    logger.error("failed to delete order", {
      orderId,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
