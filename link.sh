# this file is used for local development
# it links the syntest-framework libraries to the syntest-javascript libraries

# NOTE: we cannot simply delete the entire @syntest folder since there are always local syntest-javascript dependencies here

# framework libraries

shx rm -rf node_modules/@syntest/analysis
shx rm -rf node_modules/@syntest/cfg
shx rm -rf node_modules/@syntest/cli-graphics
shx rm -rf node_modules/@syntest/diagnostics
shx rm -rf node_modules/@syntest/logging
shx rm -rf node_modules/@syntest/metric
shx rm -rf node_modules/@syntest/module
shx rm -rf node_modules/@syntest/prng
shx rm -rf node_modules/@syntest/search
shx rm -rf node_modules/@syntest/storage

# framework plugins
shx rm -rf node_modules/@syntest/plugin-event-listener-state-storage
shx rm -rf node_modules/@syntest/plugin-event-listener-websocket
shx rm -rf node_modules/@syntest/plugin-metric-middleware-file-writer
shx rm -rf node_modules/@syntest/plugin-metric-middleware-statistics
shx rm -rf node_modules/@syntest/plugin-search-algorithm-experimental

# framework tools
shx rm -rf node_modules/@syntest/base-language
shx rm -rf node_modules/@syntest/cli
shx rm -rf node_modules/@syntest/init


cd node_modules/@syntest

# framework libraries
ln -s ../../../syntest-framework/libraries/analysis analysis
ln -s ../../../syntest-framework/libraries/cfg cfg
ln -s ../../../syntest-framework/libraries/cli-graphics cli-graphics
ln -s ../../../syntest-framework/libraries/diagnostics diagnostics
ln -s ../../../syntest-framework/libraries/logging logging
ln -s ../../../syntest-framework/libraries/metric metric
ln -s ../../../syntest-framework/libraries/module module
ln -s ../../../syntest-framework/libraries/prng prng
ln -s ../../../syntest-framework/libraries/search search
ln -s ../../../syntest-framework/libraries/storage storage

# framework plugins
ln -s ../../../syntest-framework/plugins/plugin-event-listener-state-storage plugin-event-listener-state-storage
ln -s ../../../syntest-framework/plugins/plugin-event-listener-websocket plugin-event-listener-websocket
ln -s ../../../syntest-framework/plugins/plugin-metric-middleware-file-writer plugin-metric-middleware-file-writer
ln -s ../../../syntest-framework/plugins/plugin-metric-middleware-statistics plugin-metric-middleware-statistics
ln -s ../../../syntest-framework/plugins/plugin-search-algorithm-experimental plugin-search-algorithm-experimental

# framework tools
ln -s ../../../syntest-framework/tools/cli cli
ln -s ../../../syntest-framework/tools/base-language base-language
ln -s ../../../syntest-framework/tools/init init
