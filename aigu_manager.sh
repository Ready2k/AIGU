#!/bin/bash
# AIGU Management & Operations Suite
# Usage: ./aigu_manager.sh [deploy | teardown | test | logs]

ACTION=$1
REGION="us-east-1"
STACK_BASE="aigu-governance"

# --- Function: Deploy All Layers ---
deploy() {
  echo "🚀 Deploying AIGU Stack Layers..."
  # Orders: Persistence -> Logic -> Gateway
  aws cloudformation deploy --template-file infra/aws/cfn-persistence.yaml --stack-name ${STACK_BASE}-persistence --region ${REGION}
  aws cloudformation deploy --template-file infra/aws/cfn-logic.yaml --stack-name ${STACK_BASE}-logic --capabilities CAPABILITY_IAM --region ${REGION}
  aws cloudformation deploy --template-file infra/aws/cfn-gateway.yaml --stack-name ${STACK_BASE}-gateway --region ${REGION}
  
  # Export API URL for the test function
  export API_URL=$(aws cloudformation describe-stacks --stack-name ${STACK_BASE}-gateway --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' --output text)
  echo "✅ Deployment Complete. API Endpoint: $API_URL"
}

# --- Function: Smoke Test the "Brain" ---
test_brain() {
  API_URL=$(aws cloudformation describe-stacks --stack-name ${STACK_BASE}-gateway --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' --output text)
  echo "🧠 Testing Intake Agent via $API_URL..."
  
  # Sending a mock "High Risk" payload to trigger Nova reasoning
  curl -X POST "${API_URL}/invoke" \
    -H "Content-Type: application/json" \
    -d '{"projectName": "Shadow Test", "description": "Implementing a new GenAI Accelerator."}'
    
  echo -e "\n✅ Test Payload Sent. Check logs for reasoning context."
}

# --- Function: Tail Agent Logic Logs ---
tail_logs() {
  LOG_GROUP="/aws/lambda/LangGraphEngineFunction"
  echo "📜 Streaming Agent Reasoning from $LOG_GROUP..."
  aws logs tail $LOG_GROUP --follow --format short
}

case $ACTION in
  deploy)   deploy ;;
  test)     test_brain ;;
  logs)     tail_logs ;;
  teardown) aws cloudformation delete-stack --stack-name ${STACK_BASE}-gateway
            aws cloudformation delete-stack --stack-name ${STACK_BASE}-logic
            aws cloudformation delete-stack --stack-name ${STACK_BASE}-persistence ;;
  *)        echo "Usage: $0 {deploy|test|logs|teardown}" ;;
esac
