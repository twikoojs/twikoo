#!/bin/bash

nohup /usr/local/bin/cloudflared tunnel --no-autoupdate run --token $CF_ZERO_TRUST_TOKEN >> /dev/stdout 2>&1 &
tkserver
