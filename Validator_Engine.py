import re
import json
import os
import sys
from datetime import datetime

# --- CONFIGURATION (GEM.S4) ---
COMPENDIUM_PATH = "Governance/GOVERNANCE_COMPENDIUM.txt"
AUDIT_LOG_DIR = ".ORCH_AUDITLOG/validator"

class Validator:
    def __init__(self, ad_text):
        self.ad_text = ad_text
        self.violation_log = []
        self.retry_count = 0 # Placeholder for session tracking
        os.makedirs(AUDIT_LOG_DIR, exist_ok=True)

    def parse_ad_block(self):
        """Extracts the AD Markdown block from the input text."""
        match = re.search(r"```markdown\n(AD-HEADER.*?AD-END)\n```", self.ad_text, re.DOTALL)
        if not match:
            self.emit_violation("VEC-001", "CRITICAL-HARD", "AEC.S2", "Markdown AD Block", "MISSING")
            return None
        return match.group(1)

    def validate_header(self, ad_block):
        """Ensures the AD-HEADER matches the mandatory AEC.S2 schema."""
        required = ["GOAL", "SCOPE", "WORKING SET IMPACT", "POLICY-B IMPACT"]
        for field in required:
            if field not in ad_block:
                self.emit_violation("VEC-002", "CRITICAL-RETRY", "AEC.S2", f"Header Field: {field}", "MISSING")

    def emit_violation(self, v_id, severity, rule_ref, expected, observed):
        """Constructs the JSON Violation Object per GEM.S2.3."""
        violation = {
            "status": "FAIL",
            "authority_level": 1 if "CRITICAL" in severity else 2,
            "severity": severity,
            "violation_id": v_id,
            "rule_reference": rule_ref,
            "expected_state": expected,
            "observed_state": observed,
            "timestamp": datetime.now().isoformat()
        }
        self.violation_log.append(violation)

    def run(self):
        block = self.parse_ad_block()
        if block:
            self.validate_header(block)
        
        if self.violation_log:
            print(json.dumps(self.violation_log, indent=2))
            sys.exit(1)
        else:
            print(json.dumps({"status": "PASS"}, indent=2))
            sys.exit(0)

if __name__ == "__main__":
    # In a real Orchestrator flow, ad_text would be passed from the LLM output.
    with open(sys.argv[1], 'r') as f:
        val = Validator(f.read())
        val.run()