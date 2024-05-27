#!/bin/bash

/usr/local/bin/cloudflared tunnel --no-autoupdate run --token $CF_ZERO_TRUST_TOKEN &
tkserver
