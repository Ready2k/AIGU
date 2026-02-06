"""
Delta Calculation Engine

Purpose: Compares current version with previous version to determine change percentage.
Implements the 15% delta threshold rule for pilot-to-production transitions.

Logic:
- Compares project scope, data sources, security controls, and architecture
- Weighted scoring system
- Returns percentage change (0-100)
- Provides detailed breakdown of changes
"""

from typing import Dict, Any, List
import difflib

def calculate_delta(current_state: Dict, previous_state: Dict) -> float:
    """
    Calculate the percentage change between two project versions.
    
    Uses weighted scoring:
    - Scope (30%): Project description changes
    - Data Sources (25%): Added/removed data sources
    - Security Controls (25%): Security changes
    - Architecture (20%): Technical architecture changes
    
    Args:
        current_state: Current project state
        previous_state: Previous project state
        
    Returns:
        float: Percentage change (0-100)
    """
    weights = {
        "scope": 0.3,
        "data_sources": 0.25,
        "security_controls": 0.25,
        "architecture": 0.2
    }
    
    total_change = 0.0
    
    # Extract artifacts
    current_artifacts = current_state.get("artifacts", {}).get("intakeData", {})
    previous_artifacts = previous_state.get("artifacts", {}).get("intakeData", {})
    
    # 1. Compare scope (project description)
    current_scope = current_artifacts.get("description", "")
    previous_scope = previous_artifacts.get("description", "")
    
    if previous_scope:
        scope_similarity = difflib.SequenceMatcher(None, current_scope, previous_scope).ratio()
        scope_change = 1 - scope_similarity
        total_change += scope_change * weights["scope"]
    
    # 2. Compare data sources
    current_sources = set(current_artifacts.get("dataSources", []))
    previous_sources = set(previous_artifacts.get("dataSources", []))
    
    if previous_sources:
        added = len(current_sources - previous_sources)
        removed = len(previous_sources - current_sources)
        source_change_count = added + removed
        source_change_ratio = source_change_count / len(previous_sources)
        total_change += min(source_change_ratio, 1.0) * weights["data_sources"]
    
    # 3. Compare security controls
    current_security = current_artifacts.get("securityControls", "")
    previous_security = previous_artifacts.get("securityControls", "")
    
    if previous_security:
        security_similarity = difflib.SequenceMatcher(None, current_security, previous_security).ratio()
        security_change = 1 - security_similarity
        total_change += security_change * weights["security_controls"]
    
    # 4. Compare architecture
    current_arch = current_artifacts.get("architecture", "")
    previous_arch = previous_artifacts.get("architecture", "")
    
    if previous_arch:
        arch_similarity = difflib.SequenceMatcher(None, current_arch, previous_arch).ratio()
        arch_change = 1 - arch_similarity
        total_change += arch_change * weights["architecture"]
    
    # Convert to percentage
    delta_percentage = round(total_change * 100, 2)
    
    return delta_percentage


def get_delta_details(current_state: Dict, previous_state: Dict) -> Dict[str, Any]:
    """
    Get detailed breakdown of changes for UI display.
    
    Args:
        current_state: Current project state
        previous_state: Previous project state
        
    Returns:
        Dict with delta percentage and list of specific changes
    """
    delta_pct = calculate_delta(current_state, previous_state)
    
    details = {
        "deltaPercentage": delta_pct,
        "exceedsThreshold": delta_pct > 15,
        "threshold": 15,
        "changes": []
    }
    
    # Extract artifacts
    current_artifacts = current_state.get("artifacts", {}).get("intakeData", {})
    previous_artifacts = previous_state.get("artifacts", {}).get("intakeData", {})
    
    # 1. Scope changes
    current_desc = current_artifacts.get("description", "")
    previous_desc = previous_artifacts.get("description", "")
    
    if current_desc != previous_desc:
        similarity = difflib.SequenceMatcher(None, current_desc, previous_desc).ratio()
        change_pct = round((1 - similarity) * 100, 1)
        details["changes"].append({
            "field": "Project Scope",
            "type": "modified",
            "severity": "high" if change_pct > 30 else "medium",
            "description": f"Project description modified ({change_pct}% change)",
            "impact": "Requires review of project objectives and success criteria"
        })
    
    # 2. Data source changes
    current_sources = set(current_artifacts.get("dataSources", []))
    previous_sources = set(previous_artifacts.get("dataSources", []))
    
    added_sources = current_sources - previous_sources
    removed_sources = previous_sources - current_sources
    
    if added_sources:
        details["changes"].append({
            "field": "Data Sources",
            "type": "added",
            "severity": "high",
            "description": f"Added {len(added_sources)} data source(s): {', '.join(added_sources)}",
            "impact": "New data sources may introduce additional privacy/security risks"
        })
    
    if removed_sources:
        details["changes"].append({
            "field": "Data Sources",
            "type": "removed",
            "severity": "medium",
            "description": f"Removed {len(removed_sources)} data source(s): {', '.join(removed_sources)}",
            "impact": "Verify that removed sources don't affect core functionality"
        })
    
    # 3. Security control changes
    current_security = current_artifacts.get("securityControls", "")
    previous_security = previous_artifacts.get("securityControls", "")
    
    if current_security != previous_security:
        similarity = difflib.SequenceMatcher(None, current_security, previous_security).ratio()
        change_pct = round((1 - similarity) * 100, 1)
        details["changes"].append({
            "field": "Security Controls",
            "type": "modified",
            "severity": "high",
            "description": f"Security controls modified ({change_pct}% change)",
            "impact": "Security changes require InfoSec review"
        })
    
    # 4. Architecture changes
    current_arch = current_artifacts.get("architecture", "")
    previous_arch = previous_artifacts.get("architecture", "")
    
    if current_arch != previous_arch:
        similarity = difflib.SequenceMatcher(None, current_arch, previous_arch).ratio()
        change_pct = round((1 - similarity) * 100, 1)
        details["changes"].append({
            "field": "Technical Architecture",
            "type": "modified",
            "severity": "high" if change_pct > 30 else "medium",
            "description": f"Architecture modified ({change_pct}% change)",
            "impact": "Architecture changes may affect scalability and performance"
        })
    
    # If no changes detected
    if not details["changes"]:
        details["changes"].append({
            "field": "No Changes",
            "type": "unchanged",
            "severity": "low",
            "description": "No significant changes detected from pilot version",
            "impact": "Project can proceed with expedited review"
        })
    
    return details


def format_delta_for_display(delta_details: Dict[str, Any]) -> str:
    """
    Format delta details for human-readable display.
    
    Args:
        delta_details: Output from get_delta_details()
        
    Returns:
        Formatted string for UI display
    """
    delta_pct = delta_details["deltaPercentage"]
    exceeds = delta_details["exceedsThreshold"]
    
    output = []
    output.append(f"📊 Delta Analysis: {delta_pct}%")
    output.append(f"Threshold: 15% {'⚠️ EXCEEDED' if exceeds else '✅ Within Limits'}")
    output.append("")
    output.append("Changes Detected:")
    
    for change in delta_details["changes"]:
        severity_icon = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(change["severity"], "⚪")
        output.append(f"{severity_icon} {change['field']}: {change['description']}")
        output.append(f"   Impact: {change['impact']}")
    
    return "\n".join(output)


# Example usage for testing
if __name__ == "__main__":
    # Test case 1: No changes
    state1 = {
        "artifacts": {
            "intakeData": {
                "description": "Test project",
                "dataSources": ["S3", "RDS"],
                "securityControls": "Encryption at rest",
                "architecture": "Serverless"
            }
        }
    }
    
    delta1 = calculate_delta(state1, state1)
    print(f"Test 1 (No changes): {delta1}% (expected: 0%)")
    
    # Test case 2: Major changes
    state2 = {
        "artifacts": {
            "intakeData": {
                "description": "Completely different project with new scope",
                "dataSources": ["S3", "RDS", "DynamoDB", "Kinesis"],
                "securityControls": "Encryption at rest and in transit, MFA required",
                "architecture": "Microservices with API Gateway"
            }
        }
    }
    
    delta2 = calculate_delta(state2, state1)
    details2 = get_delta_details(state2, state1)
    print(f"\nTest 2 (Major changes): {delta2}% (expected: >15%)")
    print(f"Exceeds threshold: {details2['exceedsThreshold']}")
    print(f"Number of changes: {len(details2['changes'])}")
    print("\nFormatted output:")
    print(format_delta_for_display(details2))
