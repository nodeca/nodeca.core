NPM_PACKAGE := $(shell node -e 'process.stdout.write(require("./package.json").name)')
NPM_VERSION := $(shell node -e 'process.stdout.write(require("./package.json").version)')

TMP_PATH    := /tmp/${NPM_PACKAGE}-$(shell date +%s)

REMOTE_NAME ?= origin
REMOTE_REPO ?= $(shell git config --get remote.${REMOTE_NAME}.url)

GITHUB_PROJ := nodeca/${NPM_PACKAGE}


help:
	echo "make help       - Print this help"
	echo "make lint       - Lint sources with JSHint"
	echo "make test       - Lint sources and run all tests"
	echo "make todo       - Find and list all TODOs"


lint:
	cd ../.. && NODECA_APP_PATH=./node_modules/${NPM_PACKAGE} $(MAKE) lint


test:
	cd ../.. && NODECA_APP=${NPM_PACKAGE} $(MAKE) test


deps-ci: ;


test-ci:
	git clone https://github.com/nodeca/nodeca.git ${TMP_PATH}

	test -n "${GITHUB_BRANCH}" && test "${GITHUB_BRANCH}" != "master" && \
		cd ${TMP_PATH} && \
		git rev-parse --verify "origin/${GITHUB_BRANCH}" && \
		git checkout -b "${GITHUB_BRANCH}" "origin/${GITHUB_BRANCH}" || true

	cd ${TMP_PATH} && $(MAKE) deps-ci
	cd ${TMP_PATH} && rm -rf ${TMP_PATH}/nodeca_modules/${NPM_PACKAGE}
	cp -r . ${TMP_PATH}/nodeca_modules/${NPM_PACKAGE}
	cd ${TMP_PATH} && NODECA_APP=${NPM_PACKAGE} $(MAKE) test-ci
	rm -rf ${TMP_PATH}


todo:
	grep 'TODO' -n -r --exclude-dir=assets --exclude-dir=\.git --exclude=Makefile . 2>/dev/null || test true


.PHONY: lint test todo
.SILENT: help lint test todo
