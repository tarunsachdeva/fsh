.PHONY: install uninstall clean test

install:
	@./scripts/install.sh

uninstall:
	@./scripts/uninstall.sh

clean:
	rm -rf node_modules
	@echo "Cleaned"

test:
	@npm test
