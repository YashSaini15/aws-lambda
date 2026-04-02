import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { healthHandler } from "./handlers/health";
import { createOrderHandler } from "./handlers/orders/createOrder";
import { getOrderHandler } from "./handlers/orders/getOrder";
import { updateOrderHandler } from "./handlers/orders/updateOrder";
import { deleteOrderHandler } from "./handlers/orders/deleteOrder";
import { createProductHandler } from "./handlers/products/createProduct";
import { getProductHandler } from "./handlers/products/getProducts";

type Handler = (
  event: APIGatewayProxyEventV2,
) => Promise<APIGatewayProxyResult>;

const routes: Record<string, Handler> = {
  "GET /health": healthHandler,
  "POST /orders": createOrderHandler,
  "GET /orders/:id": getOrderHandler,
  "PUT /orders/:id": updateOrderHandler,
  "DELETE /orders/:id": deleteOrderHandler,
  "POST /products": createProductHandler,
  "GET /products/:id": getProductHandler,
};

const matchRoute = (method: string, path: string): Handler | undefined => {
  for (const routeKey in routes) {
    const [routeMethod, routePath] = routeKey.split(" ");
    if (routeMethod !== method) continue;

    const routeSegments = routePath.split("/").filter(Boolean);
    const pathSegments = path.split("/").filter(Boolean);

    if (routeSegments.length !== pathSegments.length) continue;

    let isMatch = true;
    for (let i = 0; i < routeSegments.length; i++) {
      if (routeSegments[i].startsWith(":")) continue; // dynamic segment
      if (routeSegments[i] !== pathSegments[i]) {
        isMatch = false;
        break;
      }
    }

    if (isMatch) {
      return routes[routeKey];
    }
  }
  return undefined; // no match found
};

export const router = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> => {
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  const handler = matchRoute(method, path);

  if (!handler) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "Not Found" }),
    };
  }

  return handler(event);
};
