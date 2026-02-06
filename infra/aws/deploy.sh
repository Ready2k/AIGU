#!/bin/bash
# AIGU Automated Deployment Script
# Deploys the 3-tier architecture in the correct dependency order.
set -e # Fail on error

# Pre-Check
if ! command -v aws &> /dev/null; then
    echo "Error: 'aws' CLI is not installed or configured. Deployment cannot proceed."
    echo "Please install the AWS CLI and run 'aws configure' first."
    exit 1
fi

STACK_NAME_BASE="aigu-governance"
REGION="us-east-1" # Region for Amazon Bedrock

echo "--- 1. Deploying Persistence Layer (Memory) ---"
aws cloudformation deploy \
  --template-file infra/aws/cfn-persistence.yaml \
  --stack-name ${STACK_NAME_BASE}-persistence \
  --region ${REGION}

echo "--- 2. Deploying Logic Layer (Brain) ---"
# Depends on Persistence Export Values (ImportValue used in template)
aws cloudformation deploy \
  --template-file infra/aws/cfn-logic.yaml \
  --stack-name ${STACK_NAME_BASE}-logic \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}

echo "--- 3. Deploying Gateway Layer (Nerves) ---"
# Depends on Logic Export Values (ImportValue used in template)
aws cloudformation deploy \
  --template-file infra/aws/cfn-gateway.yaml \
  --stack-name ${STACK_NAME_BASE}-gateway \
  --region ${REGION}

# Post-Deployment: Fetch Output
API_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME_BASE}-gateway \
    --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
    --output text \
    --region ${REGION})

echo "--- Deployment Complete. AIGU is now LIVE. ---"
echo "API Endpoint: ${API_ENDPOINT}"
echo "Please update ui/hooks/useAiguState.js with this URL."