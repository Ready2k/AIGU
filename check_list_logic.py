
import boto3
import os
import json

def list_files(user_id, submission_id):
    s3_client = boto3.client('s3', region_name='us-east-1')
    bucket_name = 'aigu-artifacts-388660028061-us-east-1' # Hardcoded from previous CFN output
    
    list_user_id = user_id if user_id and user_id != 'null' else "anonymous"
    prefix = f"uploads/{list_user_id}/{submission_id}/"
    
    print(f"Checking prefix: {prefix}")
    
    response = s3_client.list_objects_v2(
        Bucket=bucket_name,
        Prefix=prefix
    )
    
    files = []
    for obj in response.get('Contents', []):
        files.append({
            "key": obj['Key'],
            "name": obj['Key'].split('/')[-1],
            "size": obj['Size']
        })
    
    return files

# Test with the specific ID from my earlier S3 scan
user_id = 'James'
submission_id = 'temp-1770579758175'

print(f"Results for {user_id} / {submission_id}:")
files = list_files(user_id, submission_id)
print(json.dumps(files, indent=2))
