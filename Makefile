.PHONY: install lint typecheck test report

install:
pip install -r requirements.txt

lint:
black --check src tests
isort --check-only src tests
flake8 src tests

typecheck:
mypy --strict src

test:
coverage run -m pytest
coverage report -m

report:
coverage html
