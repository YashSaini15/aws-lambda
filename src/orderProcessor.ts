import { SQSEvent } from "aws-lambda";

const log = {
  info: (message: string, data?: object) => {
    console.log(JSON.stringify({ level: "INFO", message, ...data }));
  },
  error: (message: string, data?: object) => {
    console.error(JSON.stringify({ level: "ERROR", message, ...data }));
  },
};

export const handler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    const order = JSON.parse(record.body);

    log.info("processing order from queue", { orderId: order.orderId });

    // In a real app you would:
    // - Send confirmation email
    // - Notify restaurant
    // - Assign delivery driver

    log.info("order processed successfully", { orderId: order.orderId });
  }
};
