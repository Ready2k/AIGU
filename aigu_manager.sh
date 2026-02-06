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
  echo "📦 Packaging Logic Layer..."
  
  # Load .env variables
  if [ -f .env ]; then
    export $(cat .env | xargs)
  fi

  # 1. Get Artifact Bucket
  ARTIFACT_BUCKET=$(aws cloudformation describe-stacks --stack-name ${STACK_BASE}-persistence --query "Stacks[0].Outputs[?OutputKey=='ArtifactBucketName'].OutputValue" --output text --region ${REGION})
  
  # 2. Build Dependencies
  rm -rf build_logic
  mkdir -p build_logic
  pip install \
      --platform manylinux2014_x86_64 \
      --target build_logic \
      --implementation cp \
      --python-version 3.12 \
      --only-binary=:all: \
      --upgrade \
      --no-cache-dir \
      -r requirements-prod.txt
  
  echo "Build Logic Contents:"
  ls -F build_logic | head -n 10

  cp -r aigu build_logic/
  
  # 3. Package & Deploy Logic
  aws cloudformation package --template-file infra/aws/cfn-logic.yaml --s3-bucket $ARTIFACT_BUCKET --output-template-file infra/aws/packaged-logic.yaml --region ${REGION}
  aws cloudformation deploy --template-file infra/aws/packaged-logic.yaml \
    --stack-name ${STACK_BASE}-logic \
    --capabilities CAPABILITY_IAM \
    --region ${REGION} \
    --parameter-overrides \
        LangFuseSecretKey="$LANGFUSE_SECRET_KEY" \
        LangFusePublicKey="$LANGFUSE_PUBLIC_KEY" \
        LangFuseHost="$LANGFUSE_BASE_URL"
  
  aws cloudformation deploy --template-file infra/aws/cfn-gateway.yaml --stack-name ${STACK_BASE}-gateway --region ${REGION}
  
  # Export API URL for the test function
  export API_URL=$(aws cloudformation describe-stacks --stack-name ${STACK_BASE}-gateway --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' --output text --region ${REGION})
  echo "✅ Deployment Complete. API Endpoint: $API_URL"
}

# --- Function: Smoke Test the "Brain" ---
test_brain() {
  # Load .env variables if present (ignoring comments)
  if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
  fi

  API_URL=$(aws cloudformation describe-stacks --stack-name ${STACK_BASE}-gateway --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' --output text --region ${REGION})
  echo "🧠 Testing Intake Agent via $API_URL..."
  
  # Constructing optional session token header
  TOKEN_HEADER=""
  if [ -n "$AWS_SESSION_TOKEN" ]; then
    TOKEN_HEADER="-H \"X-Amz-Security-Token: $AWS_SESSION_TOKEN\""
  fi

  # Sending a mock "High Risk" payload with AWS SigV4 signatures
  eval "curl -s -X POST \"${API_URL}/invoke\" \
    --aws-sigv4 \"aws:amz:us-east-1:execute-api\" \
    --user \"${AWS_ACCESS_KEY_ID}:${AWS_SECRET_ACCESS_KEY}\" \
    $TOKEN_HEADER \
    -H \"Content-Type: application/json\" \
    -d '{\"artifacts\": {\"intakeData\": {\"projectName\": \"Shadow Test\", \"description\": \"Implementing a new GenAI Accelerator.\"}}, \"submissionId\": \"test-123\", \"userId\": \"user-123\"}'" | jq .
    
  echo -e "\n✅ Authenticated Test Payload Sent."
}

# --- Function: Tail Agent Logic Logs ---
tail_logs() {
  LOG_GROUP="/aws/lambda/AIGU-LangGraph-Engine"
  echo "📜 Streaming Agent Reasoning from $LOG_GROUP..."
  aws logs tail $LOG_GROUP --follow --format short --region ${REGION}
}

# --- Function: Start UI ---
start_ui() {
  echo "🖥️  Starting AIGU Web Dashboard..."
  # Increase file descriptor limit to prevent EMFILE errors
  ulimit -n 65536 2>/dev/null || ulimit -n 4096
  echo "DEBUG: Current ulimit -n is $(ulimit -n)"
  cd ui
  npm run web -- --clear
}

# --- Function: Stop UI ---
stop_ui() {
  echo "🛑 Stopping AIGU Web Dashboard..."
  pkill -f "expo start" || echo "No Expo process found."
  pkill -f "aigu-ui" || echo "No UI process found."
  # Also kill node processes running metro
  lsof -ti:8081 | xargs kill -9 2>/dev/null || echo "Port 8081 already clear."
  echo "✅ UI Service Stopped."
}

case $ACTION in
  deploy)   deploy ;;
  test)     test_brain ;;
  logs)     tail_logs ;;
  ui)       
    if [ "$2" == "stop" ]; then
      stop_ui
    else
      start_ui
    fi 
    ;;
  teardown) aws cloudformation delete-stack --stack-name ${STACK_BASE}-gateway --region ${REGION} --region ${REGION}
            aws cloudformation delete-stack --stack-name ${STACK_BASE}-logic --region ${REGION}
            aws cloudformation delete-stack --stack-name ${STACK_BASE}-persistence --region ${REGION} ;;
  *)        echo "Usage: $0 {deploy|test|logs|ui|teardown}" ;;
esac
