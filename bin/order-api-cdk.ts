#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { OrderApiCdkStack } from '../lib/order-api-cdk-stack';

const app = new cdk.App();

new OrderApiCdkStack(app, 'OrderApiCdkStack-dev', {
  stageName: 'dev',
  env: { region: 'eu-north-1' }
})

new OrderApiCdkStack(app, 'OrderApiCdkStack-prod', {
  stageName: 'prod',
  env: { region: 'eu-north-1' }
})