#!/bin/zsh
set -eu
cd "${0:A:h}"
node scripts/manage-macos.mjs install "$@"
