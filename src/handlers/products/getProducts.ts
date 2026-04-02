import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { logger } from "../../lib/logger";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../../lib/dynamo";

export const getProductHandler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> => {
  logger.info("incoming request", {
    method: event.requestContext.http.method,
    path: event.rawPath,
  });
  const productId = event.rawPath.split("/")[2];
  if (!productId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "productId is required" }),
    };
  }

  try {
    const product = await db.send(
      new GetCommand({
        TableName: process.env.PRODUCTS_TABLE_NAME,
        Key: { productId },
      }),
    );

    if (product.Item === undefined) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Product not found" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Product details for productId: " + productId,
        product: product.Item,
      }),
    };
  } catch (error) {
    logger.error("failed to get product", {
      productId,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
