"""Shared subprocess env for the hunt CLI test suites (#526).

The load gate (#488) refuses to start above a 1-minute load of 24 unless
`HUNT_FAKE_LOAD1` overrides it. A subprocess test that starts the `hunt`
CLI without setting it inherits whatever the real box's load is, so a
success-directed test fails whenever the box happens to be busy. Every
subprocess launch that expects the hunt to actually run uses `success_env`
so the gate always reads idle regardless of the real machine; a test that
means to exercise the gate itself passes its own `HUNT_FAKE_LOAD1` through
`overrides` instead.
"""

import os


def success_env(overrides=None):
    env = dict(os.environ)
    env["HUNT_FAKE_LOAD1"] = "0"
    if overrides:
        env.update(overrides)
    return env
