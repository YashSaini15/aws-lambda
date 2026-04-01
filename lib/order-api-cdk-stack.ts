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
// import * as sqs from 'aws-cdk-lib/aws-sqs';

interface OrderApiCdkStackProps extends cdk.StackProps {
  stageName: string;
}
export class OrderApiCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: OrderApiCdkStackProps) {
    super(scope, id, props);

    const ordersTable = new dynamodb.Table(this, "Orders", {
      tableName: `Orders-${props.stageName}`,
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
