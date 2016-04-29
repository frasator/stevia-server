#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DIR="$( cd "$( dirname "$SCRIPT_DIR" )" && pwd )"
LOGNAME=${DIR//\//_}

forever -a -l ~/.forever/"$LOGNAME-server.log" --workingDir $DIR start "$DIR/server.js"
forever -a -l ~/.forever/"$LOGNAME-daemon.log" --workingDir $DIR start "$DIR/daemon.js"
