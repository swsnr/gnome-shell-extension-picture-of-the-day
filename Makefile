PREFIX = /usr/local
DESTDIR =

UUID = picture-of-the-day@swsnr.de
XGETTEXT_METADATA = \
	--package-name=$(UUID) \
	--copyright-holder "Sebastian Wiesner <sebastian@swsnr.de>"

DIST-EXTRA-SRC = README.md LICENSE-GPL2 LICENSE-MPL2 icons/
BLUEPRINTS = $(wildcard ui/*.blp)
UIDEFS = $(addsuffix .ui,$(basename $(BLUEPRINTS)))
CATALOGS = $(wildcard po/*.po)

.PHONY: dist
dist: compile
	mkdir -p ./dist/
	mkdir -p ./build/ui
	cp -t ./build/ui $(UIDEFS)
	cp -t ./build/lib/vendor/saxes ./src/lib/vendor/saxes/README.md
	cp -t ./build/lib/vendor/xmlchars ./src/lib/vendor/xmlchars/README.md
	gnome-extensions pack --force --out-dir dist build \
		--podir=../po --extra-source=../metadata.json \
		--extra-source=ui --extra-source=lib \
		$(addprefix --extra-source=../,$(DIST-EXTRA-SRC)) \
		$(addprefix --schema=../,$(wildcard schemas/*.gschema.xml))

# Make a reproducible dist package
.PHONY: dist-repro
dist-repro: dist
	strip-nondeterminism dist/$(UUID).shell-extension.zip

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

.PHONY: compile
compile:
	pnpm compile

# For blueprint, see https://jwestman.pages.gitlab.gnome.org/blueprint-compiler/translations.html
# The language doesn't really matter for blueprint, but xgettext warns if we don't set it
.PHONY: pot
pot:
	find src -name '*.ts' | \
		xargs xgettext $(XGETTEXT_METADATA) --sort-by-file \
			--from-code=UTF-8 --language=JavaScript --output=po/$(UUID).pot
	xgettext $(XGETTEXT_METADATA) --from-code=UTF-8 --language=C \
		--join-existing --sort-by-file --output=po/$(UUID).pot \
		--add-comments --keyword=_ --keyword=C_:1c,2 \
		$(BLUEPRINTS)
