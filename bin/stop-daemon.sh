#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DIR="$( cd "$( dirname "$SCRIPT_DIR" )" && pwd )"

forever stop "$DIR/daemon.js"
