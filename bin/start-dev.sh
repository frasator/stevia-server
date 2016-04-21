#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DIR="$( cd "$( dirname "$SCRIPT_DIR" )" && pwd )"

forever -w --watchDirectory $DIR -a -l ~/.forever/stevia-server.log --workingDir $DIR start "$DIR/server.js"
forever -w --watchDirectory $DIR -a -l ~/.forever/stevia-daemon.log --workingDir $DIR start "$DIR/daemon.js"
