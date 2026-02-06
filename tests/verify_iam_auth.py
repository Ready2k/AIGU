import json
import requests
import boto3
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest

def test_signed_request():
    url = "https://7rhp69zmfh.execute-api.us-east-1.amazonaws.com/v1/invoke"
    method = "POST"
    data = {"submissionId": "test-verify-iam", "userId": "admin"}
    body = json.dumps(data)
    
    session = boto3.Session()
    credentials = session.get_credentials()
    region = "us-east-1"
    service = "execute-api"
    
    request = AWSRequest(method=method, url=url, data=body)
    SigV4Auth(credentials.get_frozen_credentials(), service, region).add_auth(request)
    
    headers = dict(request.headers)
    headers["Content-Type"] = "application/json"
    
    response = requests.request(method, url, headers=headers, data=body)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")

if __name__ == "__main__":
    test_signed_request()
