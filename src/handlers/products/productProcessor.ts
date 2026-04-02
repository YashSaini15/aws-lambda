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
    const product = JSON.parse(record.body);

    log.info("processing product from queue", { productId: product.productId });

    // In a real app you would:
    // - Update inventory
    // - Notify suppliers

    log.info("product processed successfully", {
      productId: product.productId,
    });
  }
};
