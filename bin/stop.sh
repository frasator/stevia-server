#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

$SCRIPT_DIR/stop-server.sh
$SCRIPT_DIR/stop-daemon.sh
