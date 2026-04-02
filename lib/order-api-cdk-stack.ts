import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigatewayv2";
import * as apigatewayIntegrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as cloudwatchActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";

interface OrderApiCdkStackProps extends cdk.StackProps {
  stageName: string;
}
export class OrderApiCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: OrderApiCdkStackProps) {
    super(scope, id, props);

    const deadLetterQueue = new sqs.Queue(this, "OrderDeadLetterQueue", {
      queueName: `order-dlq-${props.stageName}`,
    });

    const productDeadLetterQueue = new sqs.Queue(
      this,
      "ProductDeadLetterQueue",
      {
        queueName: `product-dlq-${props.stageName}`,
      },
    );

    const orderQueue = new sqs.Queue(this, "OrderQueue", {
      queueName: `orders-${props.stageName}`,
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3, // move to DLQ after 3 failed attempts
      },
    });

    const productQueue = new sqs.Queue(this, "ProductQueue", {
      queueName: `products-${props.stageName}`,
      deadLetterQueue: {
        queue: productDeadLetterQueue,
        maxReceiveCount: 3, // move to DLQ after 3 failed attempts
      },
    });

    const ordersTable = new dynamodb.Table(this, "Orders", {
      tableName: `Orders-${props.stageName}`,
      partitionKey: { name: "orderId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const productsTable = new dynamodb.Table(this, "Products", {
      tableName: `Products-${props.stageName}`,
      partitionKey: { name: "productId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const orderApiHandler = new lambda.Function(this, "OrderApiHandler", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("dist"),
      environment: {
        TABLE_NAME: ordersTable.tableName,
        QUEUE_URL: orderQueue.queueUrl,
        PRODUCTS_TABLE_NAME: productsTable.tableName,
        PRODUCTS_QUEUE_URL: productQueue.queueUrl,
      },
    });

    const orderProcessorHandler = new lambda.Function(
      this,
      "OrderProcessorHandler",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "handlers/orders/orderProcessor.handler",
        code: lambda.Code.fromAsset("dist"),
      },
    );

    orderProcessorHandler.addEventSource(
      new lambdaEventSources.SqsEventSource(orderQueue, {
        batchSize: 10,
      }),
    );

    const productProcessorHandler = new lambda.Function(
      this,
      "ProductProcessorHandler",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "handlers/products/productProcessor.handler",
        code: lambda.Code.fromAsset("dist"),
      },
    );

    productProcessorHandler.addEventSource(
      new lambdaEventSources.SqsEventSource(productQueue, {
        batchSize: 10,
      }),
    );

    const errorMetric = orderApiHandler.metricErrors({
      period: cdk.Duration.minutes(5),
    });

    const alarm = new cloudwatch.Alarm(this, "LambdaErrorAlarm", {
      metric: errorMetric,
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: `Lambda errors in ${props.stageName}`,
    });

    const alarmTopic = new sns.Topic(this, "AlarmTopic", {
      topicName: `lambda-errors-${props.stageName}`,
    });

    alarmTopic.addSubscription(
      new snsSubscriptions.EmailSubscription("er.saini.yash@gmail.com"),
    );

    alarm.addAlarmAction(new cloudwatchActions.SnsAction(alarmTopic));

    ordersTable.grantReadWriteData(orderApiHandler);
    orderQueue.grantSendMessages(orderApiHandler);
    orderQueue.grantConsumeMessages(orderProcessorHandler);

    productsTable.grantReadWriteData(orderApiHandler);
    productQueue.grantSendMessages(orderApiHandler);
    productQueue.grantConsumeMessages(productProcessorHandler);

    const api = new apigateway.HttpApi(this, "OrderApi", {
      defaultIntegration: new apigatewayIntegrations.HttpLambdaIntegration(
        "OrderApiHandlerIntegration",
        orderApiHandler,
      ),
    });

    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url!,
      description: "API Gateway URL",
    });
  }
}
