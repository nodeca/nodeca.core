PATH        := ../../node_modules/.bin:${PATH}

NPM_PACKAGE := $(shell node -e 'process.stdout.write(require("./package.json").name)')
NPM_VERSION := $(shell node -e 'process.stdout.write(require("./package.json").version)')

TMP_PATH    := /tmp/${NPM_PACKAGE}-$(shell date +%s)

REMOTE_NAME ?= origin
REMOTE_REPO ?= $(shell git config --get remote.${REMOTE_NAME}.url)

CURR_HEAD   := $(firstword $(shell git show-ref --hash HEAD | sed 's/^\(.\{6\}\).*$$/\1/') master)
GITHUB_PROJ := nodeca/${NPM_PACKAGE}


help:
	echo "make help       - Print this help"
	echo "make lint       - Lint sources with JSHint"
	echo "make test       - Lint sources and run all tests"
	echo "make publish    - Set new version tag and publish npm package"
	echo "make todo       - Find and list all TODOs"


lint:
	if test ! `which jshint` ; then \
		echo "You need 'jshint' installed in order to run lint." >&2 ; \
		echo "Make sure parent app is installed right" >&2 ; \
		exit 128 ; \
		fi
	jshint . --show-non-errors


test: lint
	cd ../.. && NODECA_APP=${NPM_PACKAGE} $(MAKE) test


test-ci: lint
	rm -rf tmp/nodeca-ci && mkdir -p tmp
	git clone git://github.com/nodeca/nodeca.git tmp/nodeca-ci
	cd tmp/nodeca-ci && NODECA_APP=${NPM_PACKAGE} $(MAKE) dev-deps test


publish:
	@if test 0 -ne `git status --porcelain | wc -l` ; then \
		echo "Unclean working tree. Commit or stash changes first." >&2 ; \
		exit 128 ; \
		fi
	@if test 0 -ne `git fetch ; git status | grep '^# Your branch' | wc -l` ; then \
		echo "Local/Remote history differs. Please push/pull changes." >&2 ; \
		exit 128 ; \
		fi
	@if test 0 -ne `git tag -l ${NPM_VERSION} | wc -l` ; then \
		echo "Tag ${NPM_VERSION} exists. Update package.json" >&2 ; \
		exit 128 ; \
		fi
	git tag ${NPM_VERSION} && git push origin ${NPM_VERSION}
	npm publish https://github.com/${GITHUB_PROJ}/tarball/${NPM_VERSION}


todo:
	grep 'TODO' -n -r --exclude-dir=assets --exclude-dir=\.git --exclude=Makefile . 2>/dev/null || test true


.PHONY: publish lint test todo
.SILENT: help lint test todo
