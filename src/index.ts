import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { router } from "./router";

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> => {
  return router(event);
};
