import pytest
import boto3
from moto import mock_aws
from unittest.mock import MagicMock

@pytest.fixture(scope="function")
def aws_credentials():
    """Mocked AWS Credentials for moto."""
    import os
    os.environ["AWS_ACCESS_KEY_ID"] = "testing"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
    os.environ["AWS_SECURITY_TOKEN"] = "testing"
    os.environ["AWS_SESSION_TOKEN"] = "testing"
    os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

@pytest.fixture(scope="function")
def dynamodb_mock(aws_credentials):
    """Create a mock DynamoDB table matching DYNAMODB_SCHEMA.md."""
    with mock_aws():
        db = boto3.resource("dynamodb", region_name="us-east-1")
        table = db.create_table(
            TableName="AIGU_Global_State",
            KeySchema=[
                {"AttributeName": "submissionId", "KeyType": "HASH"},
                {"AttributeName": "userId", "KeyType": "RANGE"}
            ],
            AttributeDefinitions=[
                {"AttributeName": "submissionId", "AttributeType": "S"},
                {"AttributeName": "userId", "AttributeType": "S"}
            ],
            ProvisionedThroughput={"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
        )
        yield table

@pytest.fixture(scope="function")
def bedrock_mock():
    """Mock the Amazon Nova model responses via Bedrock."""
    client = MagicMock()
    # Simulate a successful Nova Pro response for the Gatekeeper or Risk agent
    client.invoke_model.return_value = {
        "body": MagicMock(read=lambda: '{"output": {"message": "Success", "riskLevel": "High"}}')
    }
    return client