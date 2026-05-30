package com.example;


public class App {
    
    private String message;
    
    public App(String message) {
        this.message = message;
    }
    
    public String getMessage() {
        return message;
    }
    
    public void setMessage(String message) {
        this.message = message;
    }
    
    public int calculateSum(int a, int b) {
        return a + b;
    }
    
    public static void main(String[] args) {
        App app = new App("Hello, World from Java!");
        System.out.println(app.getMessage());
        
        int result = app.calculateSum(15, 25);
        System.out.println("Sum: " + result);
    }
}

