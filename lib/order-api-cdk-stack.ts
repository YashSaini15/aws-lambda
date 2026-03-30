import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigatewayv2";
import * as apigatewayIntegrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class OrderApiCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const ordersTable = new dynamodb.Table(this, "Orders", {
      partitionKey: { name: "orderId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const orderApiHandler = new lambda.Function(this, "OrderApiHandler", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("dist"),
      environment: {
        TABLE_NAME: ordersTable.tableName,
      },
    });
    
    ordersTable.grantReadWriteData(orderApiHandler);

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

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'OrderApiCdkQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
