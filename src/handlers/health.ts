import { APIGatewayProxyResult } from "aws-lambda";
import { logger } from "../lib/logger";

export const healthHandler = async (): Promise<APIGatewayProxyResult> => {
  logger.info("health check");
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "OK" }),
  };
};
