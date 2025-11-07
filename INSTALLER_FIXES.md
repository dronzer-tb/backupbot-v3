# Installation Script Fixes

## Issues Found and Fixed

### 1. **Input Not Being Captured**

**Problem**: The `ask_question` helper function was not working correctly with `read`, causing variables to be empty.

**Solution**: Replaced all `ask_question` calls with direct `read` statements:

```bash
# Before (broken):
PANEL_URL=$(ask_question "Enter your Pterodactyl panel URL" "")

# After (fixed):
echo -e "Enter your Pterodactyl panel URL:"
echo -n "> "
read PANEL_URL
```

### 2. **Script Exiting on Connection Failure**

**Problem**: The script had `set -e` which causes immediate exit on any error. When curl failed (HTTP 000), the script exited without proper error handling.

**Solution**: 
- Added error handling with `|| echo "000"` to prevent curl from crashing the script
- Added retry logic with helpful error messages
- Wrapped connection test in proper validation

```bash
# Before:
local test_response=$(curl -s -o /dev/null -w "%{http_code}" ...)

# After:
test_response=$(curl -s -o /dev/null -w "%{http_code}" ... 2>/dev/null || echo "000")

if [ "$test_response" = "200" ]; then
    # Success
else
    # Show error and allow retry
fi
```

### 3. **Missing curl Dependency**

**Problem**: The script assumed `curl` was installed but didn't check or install it.

**Solution**: Added `install_curl()` function and call it before other dependencies:

```bash
install_curl() {
    if command -v curl &> /dev/null; then
        return
    fi
    
    print_info "Installing curl..."
    apt-get install -y curl >/dev/null 2>&1 || yum install -y curl >/dev/null 2>&1
    print_success "curl installed"
}
```

### 4. **No Validation Loop for Inputs**

**Problem**: If users entered incorrect credentials, the script would just exit.

**Solution**: Added `while true` loops with retry options:

```bash
while true; do
    echo -e "Enter your Pterodactyl panel URL:"
    echo -n "> "
    read PANEL_URL
    
    if [ -z "$PANEL_URL" ]; then
        print_warning "Panel URL is required"
        continue
    fi
    
    # Remove trailing slash
    PANEL_URL="${PANEL_URL%/}"
    break
done
```

### 5. **Connection Test with Empty Variables**

**Problem**: The curl command was being executed before variables were populated.

**Solution**: Moved connection test AFTER input collection and added proper validation:

```bash
# Get input first
read PANEL_URL
read API_KEY

# Then test with populated variables
test_response=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $API_KEY" \
    "${PANEL_URL}/api/client" 2>/dev/null || echo "000")
```

### 6. **Better Error Messages**

**Problem**: Generic "Connection failed" message wasn't helpful.

**Solution**: Added detailed troubleshooting hints:

```bash
print_error "Connection failed (HTTP $test_response)"
print_warning "Common issues:"
print_warning "  • Check that panel URL is correct (${PANEL_URL})"
print_warning "  • Verify API key is valid and not expired"
print_warning "  • Ensure panel is accessible from this server"
```

## All Fixed Sections

1. ✅ `configure_pterodactyl()` - Panel URL, API key, server ID
2. ✅ `configure_backup()` - World path, backup directory, retention
3. ✅ `configure_offsite()` - Offsite retention, bandwidth limit
4. ✅ `configure_discord()` - Guild ID, channel ID
5. ✅ `configure_alerts()` - Warning and critical thresholds
6. ✅ `install_curl()` - New function to ensure curl is available

## Testing Recommendations

Test the installer with:

1. **Valid credentials** - Should complete successfully
2. **Invalid panel URL** - Should show error and allow retry
3. **Invalid API key** - Should fail connection test gracefully
4. **Invalid server ID** - Should show error and allow retry
5. **Empty inputs** - Should show warning and re-prompt
6. **Ctrl+C during prompts** - Should exit cleanly

## How to Test

```bash
# Test locally (will prompt for inputs)
sudo ./install.sh

# Test with debugging
sudo bash -x ./install.sh
```

## Common Issues Users Might Face

1. **"Connection failed (HTTP 000)"**
   - Panel URL is incorrect
   - No internet connection
   - curl not installed (now auto-installs)
   - Firewall blocking connection

2. **"Server not found"**
   - Wrong server ID
   - API key doesn't have access to that server
   - Server was deleted

3. **Empty prompts**
   - Fixed! Now uses direct `read` instead of function wrapper

## Deployment

After testing, users can install with:

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/backupbot-v3/main/install.sh | sudo bash
```

All fixes are backward compatible and improve the installation experience significantly!
