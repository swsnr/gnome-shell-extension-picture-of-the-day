PREFIX = /usr/local
DESTDIR =
HOME-DESTDIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

UUID = picture-of-the-day@swsnr.de
XGETTEXT_METADATA = \
	--package-name=$(UUID) \
	--copyright-holder "Sebastian Wiesner <sebastian@swsnr.de>"

DIST-EXTRA-SRC = LICENSE-GPL2 LICENSE-MPL2 icons/
BLUEPRINTS = $(wildcard ui/*.blp)
UIDEFS = $(addsuffix .ui,$(basename $(BLUEPRINTS)))

.PHONY: dist
dist: compile
	mkdir -p ./dist/
	mkdir -p ./build/ui
	cp -t ./build/ui $(UIDEFS)
	gnome-extensions pack --force --out-dir dist build \
		--podir=../po --extra-source=../metadata.json \
		--extra-source=ui --extra-source=lib \
		$(addprefix --extra-source=../,$(DIST-EXTRA-SRC)) \
		$(addprefix --schema=../,$(wildcard schemas/*.gschema.xml))

# Make a reproducible dist package
.PHONY: dist-repro
dist-repro: dist
	strip-nondeterminism dist/$(UUID).shell-extension.zip

# Install to local home directory; this simply unpacks the zip file as GNOME would do
.PHONY: install-home
install-home: dist
	mkdir -p $(HOME-DESTDIR)
	gnome-extensions install -f dist/$(UUID).shell-extension.zip

.PHONY: uninstall-home
uninstall-home:
	rm -rf $(HOME-DESTDIR)

# Install as a system-wide installation schema, into a separate directory
# Intended for distribution packaging
.PHONY: install-package
install-package: dist
	install -d \
		$(DESTDIR)/$(PREFIX)/share/gnome-shell/extensions/$(UUID) \
		$(DESTDIR)/$(PREFIX)/share/glib-2.0/
	bsdtar -xf dist/$(UUID).shell-extension.zip \
		-C $(DESTDIR)/$(PREFIX)/share/gnome-shell/extensions/$(UUID) --no-same-owner
	mv -T --no-clobber \
		$(DESTDIR)/$(PREFIX)/share/gnome-shell/extensions/$(UUID)/schemas \
		$(DESTDIR)/$(PREFIX)/share/glib-2.0/schemas
	mv -T --no-clobber \
		$(DESTDIR)/$(PREFIX)/share/gnome-shell/extensions/$(UUID)/locale \
		$(DESTDIR)/$(PREFIX)/share/locale

.PHONY: clean
clean:
	rm -rf dist build

.PHONY: compile
compile: $(UIDEFS)
	npm run compile

.PHONY: generate
generate:
	npm run generate:gir-types

# For blueprint, see https://jwestman.pages.gitlab.gnome.org/blueprint-compiler/translations.html
# The language doesn't really matter for blueprint, but xgettext warns if we don't set it
.PHONY: pot
pot:
	find src -name '*.ts' | \
		xargs xgettext $(XGETTEXT_METADATA) \
			--from-code=UTF-8 --language=JavaScript --output=po/$(UUID).pot
	xgettext $(XGETTEXT_METADATA) --from-code=UTF-8 --language=C \
		--join-existing --output=po/$(UUID).pot \
		 --add-comments --keyword=_ --keyword=C_:1c,2 \
		$(wildcard ui/*.blp)

.PHONY: format
format:
	npm run format -- --write

.PHONY: lint
lint:
	npm run lint

.PHONY: check-types
check-types:
	npm run check:types

.PHONY: check
check: lint check-types
	npm run format -- --check

.PHONY: fix
fix: format
	npm run lint -- --fix

$(UIDEFS): %.ui: %.blp
	blueprint-compiler compile --output $@ $<
