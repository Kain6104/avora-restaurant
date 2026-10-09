using System;
using System.Windows;
using System.Windows.Controls;

namespace AvoraPosNative.Dialogs
{
    public partial class NumericKeypadDialog : Window
    {
        private string _currentDigits = "0";

        public decimal ResultValue
        {
            get
            {
                if (decimal.TryParse(_currentDigits, out decimal val)) return val;
                return 0;
            }
        }

        public string DisplayText => _currentDigits;

        public NumericKeypadDialog(string title = "Nhập Số Tiền", decimal initialValue = 0, decimal min = 0, decimal max = 999999999)
        {
            InitializeComponent();
            txtTitle.Text = title;
            _currentDigits = initialValue > 0 ? ((long)initialValue).ToString() : "0";
            UpdateDisplay();
        }

        private void BtnNum_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Content != null)
            {
                string text = btn.Content.ToString()!;
                if (_currentDigits == "0")
                {
                    _currentDigits = text == "000" ? "0" : text;
                }
                else
                {
                    if (_currentDigits.Length < 12)
                    {
                        _currentDigits += text;
                    }
                }
                UpdateDisplay();
            }
        }

        private void BtnBack_Click(object sender, RoutedEventArgs e)
        {
            if (_currentDigits.Length > 1)
            {
                _currentDigits = _currentDigits.Substring(0, _currentDigits.Length - 1);
            }
            else
            {
                _currentDigits = "0";
            }
            UpdateDisplay();
        }

        private void UpdateDisplay()
        {
            if (decimal.TryParse(_currentDigits, out decimal val))
            {
                txtValue.Text = $"{val:N0}đ";
            }
            else
            {
                txtValue.Text = "0đ";
            }
        }

        private void BtnCancel_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }

        private void BtnConfirm_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = true;
            Close();
        }
    }
}
