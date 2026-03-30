import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> => {
  if (
    event.rawPath === "/health" &&
    event.requestContext.http.method === "GET"
  ) {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "OK" }),
    };
  } else if (event.requestContext.http.method === "GET") {
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
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Internal Server Error" }),
      };
    }
  } else if (event.requestContext.http.method === "PUT") {
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
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid request body" }),
      };
    }
  } else if (
    event.rawPath === "/orders" &&
    event.requestContext.http.method === "POST"
  ) {
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

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Processing order: " + body.orderId }),
      };
    } catch (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid request body" }),
      };
    }
  } else if (event.requestContext.http.method === "DELETE") {
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
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Internal Server Error" }),
      };
    }
  } else {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "Not Found" }),
    };
  }
};
