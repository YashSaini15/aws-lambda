import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);
const sqsClient = new SQSClient({});

const log = {
  info: (message: string, data?: object) => {
    console.log(JSON.stringify({ level: "INFO", message, ...data }));
  },
  error: (message: string, data?: object) => {
    console.error(JSON.stringify({ level: "ERROR", message, ...data }));
  },
};

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> => {
  if (
    event.rawPath === "/health" &&
    event.requestContext.http.method === "GET"
  ) {
    log.info("incoming request", {
      method: event.requestContext.http.method,
      path: event.rawPath,
    });
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "OK" }),
    };
  } else if (event.requestContext.http.method === "GET") {
    log.info("incoming request", {
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
      log.error("failed to get order", {
        orderId,
        error: error instanceof Error ? error.message : "unknown error",
      });
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Internal Server Error" }),
      };
    }
  } else if (event.requestContext.http.method === "PUT") {
    log.info("incoming request", {
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
      log.error("failed to update order", {
        orderId,
        error: error instanceof Error ? error.message : "unknown error",
      });
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Internal Server Error" }),
      };
    }
  } else if (
    event.rawPath === "/orders" &&
    event.requestContext.http.method === "POST"
  ) {
    log.info("incoming request", {
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
      log.error("failed to create order", {
        error: error instanceof Error ? error.message : "unknown error",
      });
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Internal Server Error" }),
      };
    }
  } else if (
    event.rawPath === "/products" &&
    event.requestContext.http.method === "POST"
  ) {
    log.info("incoming request", {
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
      if (!body.productId) {
        return {
          statusCode: 422,
          body: JSON.stringify({ message: "productId is required" }),
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
        body: JSON.stringify({ message: "Processing product: " + body.productId }),
      };
    } catch (error) {
      log.error("failed to create product", {
        error: error instanceof Error ? error.message : "unknown error",
      });
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Internal Server Error" }),
      };
    }
  } else if (event.requestContext.http.method === "DELETE") {
    log.info("incoming request", {
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
      log.error("failed to delete order", {
        orderId,
        error: error instanceof Error ? error.message : "unknown error",
      });
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Internal Server Error" }),
      };
    }
  } else {
    log.info("incoming request", {
      method: event.requestContext.http.method,
      path: event.rawPath,
    });
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "Not Found" }),
    };
  }
};
