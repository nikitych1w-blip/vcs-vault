def hello_world():
    return "Hello, World from Python!"


def calculate_sum(a, b):
    return a + b


if __name__ == "__main__":
    print(hello_world())
    result = calculate_sum(10, 20)
    print(f"Sum: {result}")
