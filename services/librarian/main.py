import os
import json
import re
from typing import Dict, Any, List
from .extractor import ContentExtractor
from aigu.llm import invoke_nova, get_active_prompt

def librarian_audit_handler(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main entry point for the Librarian Upgrade.
    Collects, Extracts, Summarizes (if needed), and Audits.
    """
    artifacts = state.get("artifacts", {})
    intake_data = artifacts.get("intakeData", {})
    tech_design = artifacts.get("technicalDesign", {})
    files = artifacts.get("files", []) # Expected to be S3 URIs or filenames
    
    extractor = ContentExtractor()
    
    extracted_results = {
        "files": {},
        "links": {}
    }
    
    # 1. Extract from S3 Files
    # (Assuming state has the S3 bucket info or files are full URIs)
    # If they are just filenames, we need to know the bucket.
    # For this implementation, we assume files are full S3 URIs or we'll skip if not.
    bucket_name = os.environ.get('ARTIFACT_BUCKET', 'aigu-artifacts')
    submission_id = state.get("submissionId", "unknown")
    user_id = state.get("userId", "anonymous")

    for file_info in files:
        # Support both raw URIs (strings) and enriched objects (dicts)
        file_path = file_info.get("uri") if isinstance(file_info, dict) else file_info
        
        # If it's a simple filename, reconstruct the expected S3 URI
        if isinstance(file_path, str) and not file_path.startswith("s3://") and not file_path.startswith("http"):
             # Format: s3://{bucket}/uploads/{userId}/{submissionId}/{filename}
             original_filename = file_path
             file_path = f"s3://{bucket_name}/uploads/{user_id}/{submission_id}/{original_filename}"
             print(f"Librarian: Reconstructed URI for legacy file {original_filename} -> {file_path}")

        if isinstance(file_path, str) and file_path.startswith("s3://"):
             print(f"Librarian: Extracting content from {file_path}")
             text = extractor.extract(file_path)
             filename = file_path.split("/")[-1]
             extracted_results["files"][filename] = text
        else:
             print(f"Librarian Warning: Skipping file extraction for {file_path} - invalid format or missing s3:// prefix")

    # 2. Extract from Links in Intake/Tech Design
    # Scan for URLs in specific fields
    
    # Safe get helper for string or dict
    def safe_get(obj, key, default=""):
        if isinstance(obj, dict):
            return obj.get(key, default) or default
        return str(obj) if obj else default

    desc = safe_get(intake_data, 'description')
    approach = safe_get(intake_data, 'technicalApproach')
    arch = safe_get(tech_design, 'architecture')
    if isinstance(tech_design, str) and not arch:
        arch = tech_design # Use the whole string as architecture if it's a string

    all_text_to_scan = f"{desc} {approach} {arch}"
    urls = re.findall(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', all_text_to_scan)
    
    for url in urls:
        if "/wiki/" in url or "/pages/" in url or "/browse/" in url:
            text = extractor.extract(url)
            extracted_results["links"][url] = text

    # 3. Context Safety (The 'Context Guard')
    full_text_blob = json.dumps(extracted_results)
    token_estimate = len(full_text_blob) // 4 # Simple estimation: 4 chars per token
    
    if token_estimate > 100000:
        print(f"Librarian: Context ({token_estimate} tokens) exceeds 100k limit. Triggering Map-Reduce.")
        final_context = trigger_map_reduce_summarization(extracted_results)
    else:
        final_context = full_text_blob

    # 4. Final Librarian Audit
    # Here we would typically update the technicalDesign or return a report.
    # For now, we return the structured context to be used by the Librarian Agent.
    return {
        "librarian_context": final_context,
        "extracted_raw": extracted_results
    }

def trigger_map_reduce_summarization(raw_data: Dict[str, Any]) -> str:
    """
    Performs a simple Map-Reduce summary of documents.
    """
    summaries = []
    
    # Map step
    for category in ["files", "links"]:
        for name, content in raw_data[category].items():
            if not content or len(content) < 100:
                continue
            
            summary = invoke_nova(
                prompt_object="Summarize the following project document focusing on technical and compliance-relevant details. Be concise.",
                messages=[{"role": "user", "content": f"Document ({name}):\n{content[:50000]}"}] # Truncate map input to avoid overflow
            )
            summaries.append(f"Summary of {name}:\n{summary}")
    
    # Reduce step - the final prompt in the agent will handle the reduction of these summaries.
    return "\n\n---\n\n".join(summaries)
