import subprocess
import json
import sys

def run_command(command):
    try:
        # Force UTF-8 and replace errors to avoid Windows cp1252 crashes
        result = subprocess.run(
            command, 
            shell=True, 
            capture_output=True, 
            text=True, 
            encoding='utf-8', 
            errors='replace'
        )
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout[:2000] if result.stdout else "",
            "stderr": result.stderr[:2000] if result.stderr else ""
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def sentinel_scan():
    report = {}
    
    print("Sentinel: Scanning Linting...")
    report["lint"] = run_command("npm run lint")
    
    print("Sentinel: Scanning Types...")
    # tsc --noEmit is often what 'build' does but safer to dry run
    report["type_check"] = run_command("npx tsc --noEmit")
    
    print("Sentinel: Running Tests...")
    report["tests"] = run_command("npm run test -- --run")
    
    overall_status = "HEALTHY"
    if not report["lint"]["success"] or not report["type_check"]["success"] or not report["tests"]["success"]:
        overall_status = "ISSUES_DETECTED"
        
    final_output = {
        "status": overall_status,
        "details": report
    }
    
    print(json.dumps(final_output, indent=2))
    
    # Exit with error code if issues found, so CI/Agent knows
    if overall_status != "HEALTHY":
        sys.exit(1)

if __name__ == "__main__":
    sentinel_scan()
