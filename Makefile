# Makefile for building the project

dir_name=$(shell basename $(CURDIR))
app_name=serverinfo
app_version=1.14.0
target_dir=$(CURDIR)/build

clean:
	rm -rf $(target_dir)

appstore: clean
	mkdir -p $(target_dir)
	tar cvzf $(target_dir)/$(app_name)-$(app_version).tar.gz ../$(dir_name) \
	--exclude=.git \
	--exclude=.github \
	--exclude=.tx \
	--exclude=build \
	--exclude=.gitignore \
	--exclude=.php_cs.dist \
	--exclude=.scrutinizer.yml \
	--exclude=.travis.yml \
	--exclude=composer.json \
	--exclude=composer.lock \
	--exclude=composer.phar \
	--exclude=l10n/no-php \
	--exclude=Makefile \
	--exclude=tests \
