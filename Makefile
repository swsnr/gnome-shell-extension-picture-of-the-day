PREFIX = /usr/local
DESTDIR =
HOME-DESTDIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

UUID = picture-of-the-day@swsnr.de
XGETTEXT_METADATA = \
	--package-name=$(UUID) \
	--copyright-holder "Sebastian Wiesner <sebastian@swsnr.de>"

DIST-EXTRA-SRC = README.md LICENSE-GPL2 LICENSE-MPL2 icons/
UIDEFS = $(wildcard ui/*.ui)
CATALOGS = $(wildcard po/*.po)

.PHONY: dist
dist: compile
	mkdir -p ./dist/
	mkdir -p ./build/ui
	cp -t ./build/ui $(UIDEFS)
	cp -t ./build/lib/vendor/saxes ./src/lib/vendor/saxes/README.md
	cp -t ./build/lib/vendor/xmlchars ./src/lib/vendor/xmlchars/README.md
	pnpm dist:format
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
	rm -f $(DESTDIR)/$(PREFIX)/share/glib-2.0/schemas/gschemas.compiled
	mv -T --no-clobber \
		$(DESTDIR)/$(PREFIX)/share/gnome-shell/extensions/$(UUID)/locale \
		$(DESTDIR)/$(PREFIX)/share/locale

.PHONY: clean
clean:
	rm -rf dist build
	rm -rf $(addsuffix .mo,$(basename $(CATALOGS)))

.PHONY: compile
compile: $(UIDEFS)
	pnpm compile

# For Gtk builder the Gtk development package needs to be installed;
# otherwise xgettext uses its built-in fallback rule and fails to extract messages.
.PHONY: pot
pot:
	find src -name '*.ts' | \
		xargs xgettext $(XGETTEXT_METADATA) \
			--from-code=UTF-8 --language=JavaScript --output=po/$(UUID).pot
	xgettext $(XGETTEXT_METADATA) --from-code=UTF-8 --join-existing --output=po/$(UUID).pot \
		 --add-comments $(UIDEFS)

.PHONY: messages
messages: $(CATALOGS)

.PHONY: format
format:
	pnpm format --write

.PHONY: lint
lint:
	pnpm lint

.PHONY: check-types
check-types:
	pnpm check:types

.PHONY: check
check: lint check-types
	pnpm format --check

.PHONY: fix
fix: format
	pnpm lint --fix

$(CATALOGS): %.po: pot
	msgmerge --update --backup=none --lang=$(notdir $(basename $@)) $@ po/picture-of-the-day@swsnr.de.pot
